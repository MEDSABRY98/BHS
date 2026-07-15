'use client';

import React, { useState, useEffect } from 'react';
import { getSingleProductAnalysis } from '../Service/inventory_service';
import {
    ChevronLeft, TrendingDown,
    RefreshCw, Box, ShoppingCart,
    Truck,
    Calendar, CalendarDays, Filter,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
    LabelList, Cell
} from 'recharts';

interface AnalysisData {
    summary: {
        sales: number;
        returns: number;
        returnsRate: string;
        netPurchases: number;
        netFlow: number;
        currentStock: number;
        endingBalance: number;
        minQ: number;
    };
    monthlyData: {
        key: string;
        label: string;
        sales: number;
        returns: number;
        purchases: number;
    }[];
    granularity?: 'day' | 'month';
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                const json = await getSingleProductAnalysis(productId, {
                    year: year || undefined,
                    month: month || undefined,
                    from: fromDate || undefined,
                    to: toDate || undefined,
                    preset: preset || undefined
                });
                if (json.success) {
                    setData(json.data as any);
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

    if (!data) return null;
    const { summary, monthlyData } = data;


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-xl min-w-[180px]">
                    <p className="text-slate-700 text-xs font-bold border-b border-slate-50 mb-3 pb-2">{label}</p>
                    <div className="flex flex-col gap-3">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">{entry.name}</span>
                                </div>
                                <span className="text-slate-900 text-lg font-black tracking-tighter">
                                    {entry.value.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    const RenderBarLabel = (props: any) => {
        const { x, y, width, value, fill } = props;
        if (!value || value === 0) return null;
        
        return (
            <text 
                x={x + width / 2} 
                y={y - 18} 
                fill={fill} 
                textAnchor="middle" 
                style={{ 
                    fontSize: '16px', 
                    fontWeight: 900,
                    fontFamily: 'inherit'
                }}
            >
                {value.toLocaleString()}
            </text>
        );
    };

    // Charts expect oldest to newest
    const chartData = [...monthlyData].reverse().map(m => ({
        month: m.label,
        Sales: m.sales,
        Returns: m.returns,
        Purchases: m.purchases
    }));

    const StatCard = ({ title, value, color, subValue, isAvg, suffix }: any) => {
        const textColorClass = color.replace('bg-', 'text-');
        const finalTextColor = textColorClass.includes('slate') ? 'text-slate-800' : textColorClass;
        
        return (
            <div className={`p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-3 ${isAvg ? 'bg-slate-50/50' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider leading-tight">{title}</h3>
                    {(isAvg || subValue) && (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            {isAvg && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200/50 px-1.5 py-0.5 rounded leading-none">Avg</span>}
                            {subValue && <span className="text-[9px] font-bold text-rose-500 uppercase bg-rose-50 px-1.5 py-0.5 rounded leading-none">{subValue}</span>}
                        </div>
                    )}
                </div>
                <div>
                    <p className={`text-2xl lg:text-3xl font-black tracking-tighter leading-none ${finalTextColor}`}>
                        {typeof value === 'number' ? Math.round(value).toLocaleString() : value}
                        {suffix && <span className="text-xs font-bold text-slate-400 ml-1 tracking-normal italic opacity-60">{suffix}</span>}
                    </p>
                </div>
            </div>
        );
    };

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
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${preset === p
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


                </div>
            </div>

            {/* High-Density KPI Grid - Single Row Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-4">
                <StatCard
                    title="Ending Balance"
                    value={summary.endingBalance ?? '—'}
                    icon={Box}
                    color="bg-emerald-600"
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
                    title="Purchases Avg"
                    value={Math.round(summary.netPurchases / (monthlyData.length || 1))}
                    icon={Truck}
                    color="bg-slate-500"
                    isAvg
                />
            </div>

            {/* Movement Trends Chart */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-10">
                <div className="flex flex-col items-center gap-6 mb-12">
                    <div className="text-center">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">
                            {data.granularity === 'day' ? 'Daily Movement Analysis' : 'Monthly Performance Trends'}
                        </h3>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Visualizing inventory velocity and cycles</p>
                    </div>

                    <div className="flex items-center gap-8 bg-slate-50 px-8 py-3 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" />
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Sales</span>
                        </div>
                        <div className="w-[1px] h-4 bg-slate-200" />
                        <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-200" />
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Purchases</span>
                        </div>
                        <div className="w-[1px] h-4 bg-slate-200" />
                        <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-200" />
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Returns</span>
                        </div>
                    </div>
                </div>

                <div className="h-[480px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 40, right: 30, left: 10, bottom: 20 }}
                            barGap={12}
                        >
                            <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#475569', fontSize: 14, fontWeight: 700 }}
                                dy={15}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />

                            <Bar dataKey="Sales" fill="#10b981" radius={[6, 6, 0, 0]} barSize={28} minPointSize={35}>
                                <LabelList dataKey="Sales" content={<RenderBarLabel />} />
                                {chartData.map((entry, index) => (
                                    <Cell key={`sales-${index}`} fill={entry.Sales === 0 ? 'transparent' : '#10b981'} />
                                ))}
                            </Bar>
                            
                            <Bar dataKey="Purchases" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={28} minPointSize={35}>
                                <LabelList dataKey="Purchases" content={<RenderBarLabel />} />
                                {chartData.map((entry, index) => (
                                    <Cell key={`purchases-${index}`} fill={entry.Purchases === 0 ? 'transparent' : '#0ea5e9'} />
                                ))}
                            </Bar>
                            
                            <Bar dataKey="Returns" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={28} minPointSize={35}>
                                <LabelList dataKey="Returns" content={<RenderBarLabel />} />
                                {chartData.map((entry, index) => (
                                    <Cell key={`returns-${index}`} fill={entry.Returns === 0 ? 'transparent' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden border-b-0">
                <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-medium text-slate-800 tracking-tight">
                            {data.granularity === 'day' ? 'Daily Tracking' : 'Monthly Breakdown'}
                        </h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-10 py-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                                    {data.granularity === 'day' ? 'Full Date' : 'Reporting Period'}
                                </th>
                                <th className="px-10 py-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Sales Qty</th>
                                <th className="px-10 py-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Returns Qty</th>
                                <th className="px-10 py-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Net Purchases</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {monthlyData.map((m, idx) => (
                                <tr key={`${m.key}-${idx}`} className="hover:bg-slate-50/70 transition-colors group">
                                    <td className="px-10 py-6 text-slate-600 font-bold text-base text-center">{m.label}</td>
                                    <td className="px-10 py-6 text-center text-slate-900 font-black text-xl tracking-tighter">
                                        {m.sales === 0 ? <span className="opacity-20">-</span> : m.sales.toLocaleString()}
                                    </td>
                                    <td className="px-10 py-6 text-center text-amber-500 font-black text-xl tracking-tighter">
                                        {m.returns === 0 ? <span className="opacity-20">-</span> : m.returns.toLocaleString()}
                                    </td>
                                    <td className="px-10 py-6 text-center text-emerald-600 font-black text-xl tracking-tighter">
                                        {m.purchases === 0 ? <span className="opacity-20">-</span> : m.purchases.toLocaleString()}
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
