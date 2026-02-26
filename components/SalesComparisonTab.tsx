'use client';

import { useState, useMemo } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import {
    Calendar,
    ArrowRightLeft,
    TrendingUp,
    Users,
    FileText,
    DollarSign,
    ArrowDownLeft,
    ArrowUpRight
} from 'lucide-react';

interface SalesComparisonTabProps {
    data: SalesInvoice[];
    loading: boolean;
}

export default function SalesComparisonTab({ data, loading }: SalesComparisonTabProps) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Period 1 Selection
    const [year1, setYear1] = useState(currentYear.toString());
    const [month1, setMonth1] = useState(currentMonth.toString());

    // Period 2 Selection
    const [year2, setYear2] = useState((currentYear - 1).toString());
    const [month2, setMonth2] = useState(currentMonth.toString());

    // Available Years from data
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        data.forEach(item => {
            if (item.invoiceDate) {
                const date = new Date(item.invoiceDate);
                if (!isNaN(date.getTime())) {
                    years.add(date.getFullYear().toString());
                }
            }
        });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [data]);

    const months = [
        { value: '1', label: 'January' },
        { value: '2', label: 'February' },
        { value: '3', label: 'March' },
        { value: '4', label: 'April' },
        { value: '5', label: 'May' },
        { value: '6', label: 'June' },
        { value: '7', label: 'July' },
        { value: '8', label: 'August' },
        { value: '9', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' },
    ];

    const getStatsForPeriod = (year: string, month: string) => {
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        const periodData = data.filter(item => {
            if (!item.invoiceDate) return false;
            const date = new Date(item.invoiceDate);
            return date.getFullYear() === yearNum && (date.getMonth() + 1) === monthNum;
        });

        const netSales = periodData.reduce((sum, item) => sum + item.amount, 0);
        const grossSales = periodData
            .filter(item => item.invoiceNumber?.trim().toUpperCase().startsWith('SAL'))
            .reduce((sum, item) => sum + item.amount, 0);
        const returns = periodData
            .filter(item => item.invoiceNumber?.trim().toUpperCase().startsWith('RSAL'))
            .reduce((sum, item) => sum + item.amount, 0);

        const uniqueCustomers = new Set(periodData.map(item => item.customerId)).size;
        const uniqueInvoices = new Set(periodData.map(item => item.invoiceNumber)).size;

        // Calculate Avg Daily Sales: Gross Sales / Days in Month
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
        const averageDaily = daysInMonth > 0 ? grossSales / daysInMonth : 0;

        return {
            netSales,
            grossSales,
            returns,
            uniqueCustomers,
            uniqueInvoices,
            averageDaily,
            count: periodData.length
        };
    };

    const stats1 = useMemo(() => getStatsForPeriod(year1, month1), [data, year1, month1]);
    const stats2 = useMemo(() => getStatsForPeriod(year2, month2), [data, year2, month2]);

    const ComparisonRow = ({
        label,
        value1,
        value2,
        isCurrency = true,
        icon: Icon
    }: {
        label: string,
        value1: number,
        value2: number,
        isCurrency?: boolean,
        icon: any
    }) => {
        const diff = value1 - value2;
        const percentDiff = value2 !== 0 ? (diff / Math.abs(value2)) * 100 : 0;
        const isPositive = diff > 0;

        const formatValue = (val: number) => {
            if (isCurrency) {
                return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(val);
            }
            return new Intl.NumberFormat('en-AE').format(val);
        };

        return (
            <div className="group bg-white hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                <div className="grid grid-cols-12 items-center py-4 px-4 md:px-8">
                    {/* Label & Icon */}
                    <div className="col-span-12 md:col-span-4 flex items-center gap-4 mb-4 md:mb-0">
                        <div className={`p-2 rounded-xl ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} transition-colors`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">{label}</p>
                        </div>
                    </div>

                    {/* Value 1 */}
                    <div className="col-span-12 md:col-span-3 text-center md:text-left mb-2 md:mb-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Period 1</p>
                        <p className="text-lg font-black text-slate-900">{formatValue(value1)}</p>
                    </div>

                    {/* Value 2 */}
                    <div className="col-span-12 md:col-span-3 text-center md:text-left mb-2 md:mb-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Period 2</p>
                        <p className="text-lg font-black text-slate-900">{formatValue(value2)}</p>
                    </div>

                    {/* Difference */}
                    <div className="col-span-12 md:col-span-2 flex justify-center md:justify-end">
                        <div className={`w-24 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            {Math.abs(percentDiff).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return null;

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-700">
            {/* Selection Header */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Period 1 Selector */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <Calendar className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-green-600 text-white rounded-lg flex items-center justify-center text-base font-black italic">1</span>
                            First Period
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Year</label>
                                <select
                                    value={year1}
                                    onChange={(e) => setYear1(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-green-600 transition-all outline-none appearance-none"
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Month</label>
                                <select
                                    value={month1}
                                    onChange={(e) => setMonth1(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-green-600 transition-all outline-none appearance-none"
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Period 2 Selector */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <Calendar className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center text-base font-black italic">2</span>
                            Second Period
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Year</label>
                                <select
                                    value={year2}
                                    onChange={(e) => setYear2(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-green-600 transition-all outline-none appearance-none"
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Month</label>
                                <select
                                    value={month2}
                                    onChange={(e) => setMonth2(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-green-600 transition-all outline-none appearance-none"
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Body */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="bg-slate-900 text-white p-5 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white">
                        <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-black">Performance Analysis</h3>
                </div>

                <div className="flex flex-col">
                    <ComparisonRow
                        label="Net Sales"
                        value1={stats1.netSales}
                        value2={stats2.netSales}
                        icon={TrendingUp}
                    />
                    <ComparisonRow
                        label="Sales Only"
                        value1={stats1.grossSales}
                        value2={stats2.grossSales}
                        icon={DollarSign}
                    />
                    <ComparisonRow
                        label="Returns Only"
                        value1={stats1.returns}
                        value2={stats2.returns}
                        icon={ArrowDownLeft}
                    />
                    <ComparisonRow
                        label="Avg Daily Sales"
                        value1={stats1.averageDaily}
                        value2={stats2.averageDaily}
                        icon={FileText}
                    />
                    <ComparisonRow
                        label="Count Customers"
                        value1={stats1.uniqueCustomers}
                        value2={stats2.uniqueCustomers}
                        isCurrency={false}
                        icon={Users}
                    />
                    <ComparisonRow
                        label="Count Invoices"
                        value1={stats1.uniqueInvoices}
                        value2={stats2.uniqueInvoices}
                        isCurrency={false}
                        icon={FileText}
                    />
                </div>
            </div>
        </div>
    );
}
