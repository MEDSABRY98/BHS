import React, { useState, useMemo } from 'react';
import {
    Activity,
    History,
    LayoutGrid,
    Users,
    Package,
    FileSpreadsheet,
    X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import NoData from '../01-Unified/NoDataTab';
import { DeliveryEntry } from './types';

interface StatsTabProps {
    filteredOrders: DeliveryEntry[];
    uniqueCities: string[];
    customerToCity: Record<string, string>;
    filterCity: string;
    setFilterCity: (city: string) => void;
    filterYear: string;
    setFilterYear: (year: string) => void;
    filterMonth: string;
    setFilterMonth: (month: string) => void;
    filterDateFrom: string;
    setFilterDateFrom: (date: string) => void;
    filterDateTo: string;
    setFilterDateTo: (date: string) => void;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function StatsTab({
    filteredOrders,
    uniqueCities,
    customerToCity,
    filterCity,
    setFilterCity,
    filterYear,
    setFilterYear,
    filterMonth,
    setFilterMonth,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    showToast
}: StatsTabProps) {
    const [statsSubTab, setStatsSubTab] = useState<'kpis' | 'daily' | 'customers' | 'cities' | 'products'>('kpis');

    const formatStat = (val: number, prefix: string = '') => {
        if (val === 0) return '-';
        return `${prefix}${val.toLocaleString()}`;
    };

    const stats = useMemo(() => {
        const total = filteredOrders.length;
        const delivered = filteredOrders.filter(o => o.status === 'delivered').length;
        const pending = filteredOrders.filter(o => o.status === 'pending').length;
        const reship = filteredOrders.filter(o => o.reship).length;
        const missingCount = filteredOrders.reduce((acc, o) => acc + o.missing.length, 0);
        const discCount = filteredOrders.filter(o => o.invoiceVal > 0 && o.invoiceVal !== o.lpoVal).length;
        const partial = filteredOrders.filter(o => o.status === 'partial').length;
        const canceledOrders = filteredOrders.filter(o => o.status === 'canceled').length;

        let favor = 0, against = 0;
        let favorCount = 0, againstCount = 0;

        let deliveredLPO = 0, deliveredInvoice = 0;
        let partialLPO = 0, partialInvoice = 0;
        let pendingLPO = 0, pendingInvoice = 0;
        let canceledLPO = 0, canceledInvoice = 0;

        let totalLPO = 0, totalInvoice = 0;

        filteredOrders.forEach(o => {
            totalLPO += (o.lpoVal || 0);
            totalInvoice += (o.invoiceVal || 0);

            // Finance diff
            if (o.status !== 'pending' || o.invoiceVal > 0) {
                const diff = (o.invoiceVal || 0) - (o.lpoVal || 0);
                if (diff < 0) {
                    favor += Math.abs(diff);
                    favorCount++;
                } else if (diff > 0) {
                    against += diff;
                    againstCount++;
                }
            }

            // Category Totals
            if (o.status === 'delivered') {
                deliveredLPO += (o.lpoVal || 0);
                deliveredInvoice += (o.invoiceVal || 0);
            } else if (o.status === 'partial') {
                partialLPO += (o.lpoVal || 0);
                partialInvoice += (o.invoiceVal || 0);
            } else if (o.status === 'pending') {
                pendingLPO += (o.lpoVal || 0);
                pendingInvoice += (o.invoiceVal || 0);
            } else if (o.status === 'canceled') {
                canceledLPO += (o.lpoVal || 0);
                canceledInvoice += (o.invoiceVal || 0);
            }
        });

        const shippedCount = filteredOrders.reduce((acc, o) => acc + (o.shippedItems?.length || 0), 0);
        const canceledCount = filteredOrders.reduce((acc, o) => acc + (o.canceledItems?.length || 0), 0);
        const totalTracked = missingCount + canceledCount;

        return {
            total, delivered, pending, reship, missingCount, discCount, partial, canceledOrders,
            favor, against, favorCount, againstCount, net: against - favor,
            shippedCount, canceledCount, totalTracked,
            deliveredLPO, deliveredInvoice,
            partialLPO, partialInvoice,
            pendingLPO, pendingInvoice,
            canceledLPO, canceledInvoice,
            totalLPO, totalInvoice
        };
    }, [filteredOrders]);

    const cityStats = useMemo(() => {
        const grouped = filteredOrders.reduce((acc: any, o) => {
            const city = customerToCity[o.customer] || 'Unknown';
            if (!acc[city]) {
                acc[city] = {
                    name: city,
                    lpoValue: 0,
                    invoiceValue: 0,
                    orders: 0,
                    delivered: 0,
                    partial: 0,
                    pending: 0,
                    canceled: 0,
                    favs: 0,
                    against: 0
                };
            }
            const c = acc[city];
            c.lpoValue += (o.lpoVal || 0);
            c.invoiceValue += (o.invoiceVal || 0);
            c.orders += 1;
            if (o.status === 'delivered') c.delivered += 1;
            if (o.status === 'partial') c.partial += 1;
            if (o.status === 'pending') c.pending += 1;
            if (o.status === 'canceled') c.canceled += 1;

            return acc;
        }, {});
        return Object.values(grouped).sort((a: any, b: any) => b.lpoValue - a.lpoValue);
    }, [filteredOrders, customerToCity]);

    const dailyStats = useMemo(() => {
        const grouped = filteredOrders.reduce((acc: any, o) => {
            const date = o.date || 'No Date';
            if (!acc[date]) {
                acc[date] = {
                    date,
                    lpoValue: 0,
                    invoiceValue: 0,
                    orders: 0,
                    delivered: 0,
                    partial: 0,
                    pending: 0,
                    canceled: 0
                };
            }
            const d = acc[date];
            d.lpoValue += (o.lpoVal || 0);
            d.invoiceValue += (o.invoiceVal || 0);
            d.orders += 1;
            if (o.status === 'delivered') d.delivered += 1;
            else if (o.status === 'partial') d.partial += 1;
            else if (o.status === 'pending') d.pending += 1;
            else if (o.status === 'canceled') d.canceled += 1;

            return acc;
        }, {});
        return Object.values(grouped).sort((a: any, b: any) => b.date.localeCompare(a.date));
    }, [filteredOrders]);

    const dailyTotals = useMemo(() => {
        return (dailyStats as any[]).reduce((acc: any, d: any) => ({
            lpoValue: acc.lpoValue + (d.lpoValue || 0),
            invoiceValue: acc.invoiceValue + (d.invoiceValue || 0),
            orders: acc.orders + (d.orders || 0),
            delivered: acc.delivered + (d.delivered || 0),
            partial: acc.partial + (d.partial || 0),
            canceled: acc.canceled + (d.canceled || 0),
            pending: acc.pending + (d.pending || 0),
        }), { lpoValue: 0, invoiceValue: 0, orders: 0, delivered: 0, partial: 0, canceled: 0, pending: 0 });
    }, [dailyStats]);

    const customerStats = useMemo(() => {
        const grouped = filteredOrders.reduce((acc: any, o) => {
            if (!acc[o.customer]) {
                acc[o.customer] = {
                    name: o.customer,
                    total: 0,
                    delivered: 0,
                    partial: 0,
                    pending: 0,
                    canceledOrders: 0,
                    missingCount: 0,
                    reshippedCount: 0,
                    canceledCount: 0
                };
            }
            const c = acc[o.customer];
            c.total += 1;
            if (o.status === 'delivered') c.delivered += 1;
            if (o.status === 'partial') c.partial += 1;
            if (o.status === 'pending') c.pending += 1;
            if (o.status === 'canceled') c.canceledOrders += 1;
            c.missingCount += (o.missing?.length || 0);
            c.reshippedCount += (o.shippedItems?.length || 0);
            c.canceledCount += (o.canceledItems?.length || 0);
            return acc;
        }, {});
        return Object.values(grouped).sort((a: any, b: any) => b.total - a.total);
    }, [filteredOrders]);

    const productStats = useMemo(() => {
        const products: any = {};
        filteredOrders.forEach(o => {
            o.missing?.forEach(item => {
                if (!products[item]) products[item] = { name: item, pending: 0, canceled: 0, shipped: 0 };
                products[item].pending += 1;
            });
            o.shippedItems?.forEach(item => {
                if (!products[item]) products[item] = { name: item, pending: 0, canceled: 0, shipped: 0 };
                products[item].shipped += 1;
            });
            o.canceledItems?.forEach(item => {
                if (!products[item]) products[item] = { name: item, pending: 0, canceled: 0, shipped: 0 };
                products[item].canceled += 1;
            });
        });
        return Object.values(products).sort((a: any, b: any) =>
            (a.name || '').localeCompare(b.name || '')
        );
    }, [filteredOrders]);

    const cityTotals = useMemo(() => {
        return (cityStats as any[]).reduce((acc: any, c: any) => ({
            lpoValue: (acc.lpoValue || 0) + (c.lpoValue || 0),
            invoiceValue: (acc.invoiceValue || 0) + (c.invoiceValue || 0),
            orders: (acc.orders || 0) + (c.orders || 0),
            delivered: (acc.delivered || 0) + (c.delivered || 0),
            partial: (acc.partial || 0) + (c.partial || 0),
            pending: (acc.pending || 0) + (c.pending || 0),
            canceled: (acc.canceled || 0) + (c.canceled || 0),
        }), { lpoValue: 0, invoiceValue: 0, orders: 0, delivered: 0, partial: 0, pending: 0, canceled: 0 });
    }, [cityStats]);

    const customerTotals = useMemo(() => {
        return (customerStats as any[]).reduce((acc: any, c: any) => ({
            total: (acc.total || 0) + (c.total || 0),
            delivered: (acc.delivered || 0) + (c.delivered || 0),
            partial: (acc.partial || 0) + (c.partial || 0),
            pending: (acc.pending || 0) + (c.pending || 0),
            canceledOrders: (acc.canceledOrders || 0) + (c.canceledOrders || 0),
            withCancel: (acc.withCancel || 0) + (c.withCancel || 0),
            missingCount: (acc.missingCount || 0) + (c.missingCount || 0),
            reshippedCount: (acc.reshippedCount || 0) + (c.reshippedCount || 0),
            canceledCount: (acc.canceledCount || 0) + (c.canceledCount || 0),
        }), {
            total: 0, delivered: 0, partial: 0, pending: 0, canceledOrders: 0, withCancel: 0,
            missingCount: 0, reshippedCount: 0, canceledCount: 0
        });
    }, [customerStats]);

    const productTotals = useMemo(() => {
        return (productStats as any[]).reduce((acc: any, p: any) => ({
            pending: acc.pending + p.pending,
            shipped: acc.shipped + p.shipped,
            canceled: acc.canceled + p.canceled,
            totalLogs: acc.totalLogs + (p.pending + p.shipped + p.canceled)
        }), { pending: 0, shipped: 0, canceled: 0, totalLogs: 0 });
    }, [productStats]);

    const exportCustomerStatsExcel = () => {
        const data = customerStats.map((c: any) => ({
            'Customer Name': c.name,
            'Total Orders': c.total,
            'Delivered': c.delivered,
            'Partial': c.partial,
            'Pending': c.pending,
            'Canceled Orders': c.canceledOrders,
            'Pending Items': c.missingCount,
            'Reshipped Items': c.reshippedCount,
            'Canceled Items': c.canceledCount
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customer Stats');
        XLSX.writeFile(wb, `Customer_Stats_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Customer stats exported successfully', 'success');
    };

    const exportProductStatsExcel = () => {
        const data = productStats.map((p: any) => ({
            'Product Name': p.name,
            'Pending Re-ship': p.pending,
            'Total Shipped': p.shipped,
            'Total Canceled': p.canceled,
            'Total Operation Logs': (p.pending || 0) + (p.shipped || 0) + (p.canceled || 0)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Product Stats');
        XLSX.writeFile(wb, `Product_Stats_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Product stats exported successfully', 'success');
    };

    const exportDailyStatsExcel = () => {
        const data = (dailyStats as any[]).map((d: any) => ({
            'Date': d.date,
            'LPO Value': d.lpoValue,
            'Invoice Value': d.invoiceValue,
            'Difference': d.invoiceValue - d.lpoValue,
            'Orders': d.orders,
            'Delivered': d.delivered,
            'Partial': d.partial,
            'Pending': d.pending,
            'Canceled': d.canceled
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Daily Stats');
        XLSX.writeFile(wb, `Daily_Stats_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Daily stats exported successfully', 'success');
    };

    const exportCityStatsExcel = () => {
        const data = cityStats.map((c: any) => ({
            'City Name': c.name,
            'LPO Value': c.lpoValue,
            'Invoice Value': c.invoiceValue,
            'Difference': c.invoiceValue - c.lpoValue,
            'Orders': c.orders,
            'Delivered': c.delivered,
            'Partial': c.partial,
            'Pending': c.pending,
            'Canceled': c.canceled
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'City Stats');
        XLSX.writeFile(wb, `City_Stats_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('City stats exported successfully', 'success');
    };

    const handleStatsExport = () => {
        if (statsSubTab === 'daily') exportDailyStatsExcel();
        else if (statsSubTab === 'cities') exportCityStatsExcel();
        else if (statsSubTab === 'customers') exportCustomerStatsExcel();
        else if (statsSubTab === 'products') exportProductStatsExcel();
        else if (statsSubTab === 'kpis') {
            showToast('KPIs export not implemented yet', 'info');
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 text-center">
            {/* GLOBAL DATE FILTER BAR */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-[24px] bg-white border-[1.5px] border-[#E4EDE8] rounded-[20px] px-8 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] w-fit mx-auto relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#4F46E5]" />
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-[900] text-indigo-600 uppercase tracking-[0.2em] whitespace-nowrap">📅 Statistics Scope</span>
                    <div className="w-px h-6 bg-slate-200" />
                </div>

                {/* City Filter */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">City</span>
                    <select
                        value={filterCity}
                        onChange={e => setFilterCity(e.target.value)}
                        className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-3 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[240px] appearance-none cursor-pointer"
                    >
                        <option value="">All Cities</option>
                        {uniqueCities.map(city => (
                            <option key={city} value={city}>{city}</option>
                        ))}
                    </select>
                </div>

                <div className="w-px h-6 bg-slate-200" />

                {/* Year */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">Year</span>
                    <input
                        type="text"
                        placeholder="2025"
                        value={filterYear}
                        onChange={e => setFilterYear(e.target.value)}
                        maxLength={4}
                        className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-3 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[85px] text-center"
                    />
                </div>

                {/* Month */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">Month</span>
                    <input
                        type="text"
                        placeholder="MM"
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        maxLength={2}
                        className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-3 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[75px] text-center"
                    />
                </div>

                <div className="w-px h-6 bg-slate-200" />

                {/* From */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">From</span>
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-4 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[160px] cursor-pointer"
                    />
                </div>

                {/* To */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-[800] text-slate-500 uppercase tracking-wider">To</span>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] px-4 py-2 text-[13px] font-[700] text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all w-[160px] cursor-pointer"
                    />
                </div>

                {/* Clear */}
                {(filterYear || filterMonth || filterDateFrom || filterDateTo || filterCity) && (
                    <>
                        <div className="w-px h-6 bg-slate-200" />
                        <button
                            onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterCity(''); }}
                            className="text-[11px] font-[900] text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-all active:scale-95 bg-red-50 px-3 py-2 rounded-lg"
                        >
                            <X className="w-3.5 h-3.5" /> RESET
                        </button>
                    </>
                )}
            </div>

            {/* STATS SUB-NAV */}
            <div className="flex items-center gap-4 mb-8 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit mx-auto relative group/nav">
                <div className="flex items-center gap-1">
                    {[
                        { id: 'kpis', label: 'General KPIs', icon: Activity },
                        { id: 'daily', label: 'Daily Stats', icon: History },
                        { id: 'cities', label: 'City Stats', icon: LayoutGrid },
                        { id: 'customers', label: 'Customer Stats', icon: Users },
                        { id: 'products', label: 'Product Stats', icon: Package },
                    ].map((sub) => (
                        <button
                            key={sub.id}
                            onClick={() => setStatsSubTab(sub.id as any)}
                            className={`
                                flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-[800] transition-all w-[180px]
                                ${statsSubTab === sub.id
                                    ? 'bg-indigo-600 text-white shadow-lg scale-105'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }
                            `}
                        >
                            <sub.icon className="w-4 h-4" />
                            {sub.label}
                        </button>
                    ))}
                </div>

                {statsSubTab !== 'kpis' && (
                    <>
                        <div className="w-px h-8 bg-slate-200 mx-1" />
                        <button
                            onClick={handleStatsExport}
                            title="Export Excel"
                            className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm flex items-center justify-center transition-colors group/btn"
                        >
                            <FileSpreadsheet className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                        </button>
                    </>
                )}
            </div>

            {statsSubTab === 'kpis' && (
                <>
                    {/* KPI GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-[14px] mb-[26px]">
                        {[
                            { label: 'Total Orders', value: stats.total, trend: `${stats.total} orders`, colorClass: 'green', icon: '📦' },
                            { label: 'Delivered', value: stats.delivered, trend: stats.total > 0 ? `${Math.round(stats.delivered / stats.total * 100)}%` : '0%', colorClass: 'blue', icon: '✅' },
                            { label: 'Partial', value: stats.partial, trend: stats.total > 0 ? `${Math.round(stats.partial / stats.total * 100)}%` : '0%', colorClass: 'orange', icon: '⚠️' },
                            { label: 'Canceled Orders', value: stats.canceledOrders, trend: stats.total > 0 ? `${Math.round(stats.canceledOrders / stats.total * 100)}%` : '0%', colorClass: 'red', icon: '❌' },
                            { label: 'Pending', value: stats.pending, trend: stats.total > 0 ? `${Math.round(stats.pending / stats.total * 100)}%` : '0%', colorClass: 'gold', icon: '⏳' },
                            { label: 'Pending Re-ship', value: stats.reship, trend: `${stats.reship} customers`, colorClass: 'orange', icon: '🔄' },
                            { label: 'Items Re-Shipped', value: stats.shippedCount, trend: `Success`, colorClass: 'green', icon: '🚚' },
                            { label: 'Items Canceled', value: stats.canceledCount, trend: `Final`, colorClass: 'red', icon: '🚫' },
                        ].map((kpi, i) => (
                            <div key={i} className={`
                                bg-white rounded-[14px] p-[18px_20px] shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-[#E4EDE8]
                                flex flex-col gap-[10px] relative overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]
                                kpi-${kpi.colorClass}
                            `}>
                                <div className={`absolute top-0 left-0 right-0 h-[3px] 
                                    ${kpi.colorClass === 'green' ? 'bg-[#2DBE6C]' :
                                    kpi.colorClass === 'blue' ? 'bg-[#2980B9]' :
                                    kpi.colorClass === 'gold' ? 'bg-[#F5A623]' :
                                    kpi.colorClass === 'red' ? 'bg-[#E74C3C]' : 'bg-[#E67E22]'}
                                `} />
                                <div className="flex items-center justify-between">
                                    <div className={`w-[36px] h-[36px] rounded-[9px] flex items-center justify-center text-[18px]
                                        ${kpi.colorClass === 'green' ? 'bg-[#E8F7EF]' :
                                        kpi.colorClass === 'blue' ? 'bg-[#EBF5FB]' :
                                        kpi.colorClass === 'gold' ? 'bg-[#FEF6E8]' :
                                        kpi.colorClass === 'red' ? 'bg-[#FDEDEC]' : 'bg-[#FEF0E7]'}
                                    `}>{kpi.icon}</div>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[6px]
                                        ${kpi.colorClass === 'green' ? 'bg-[#E8F7EF] text-[#1A8A47]' :
                                        kpi.colorClass === 'blue' ? 'bg-[#EBF5FB] text-[#2980B9]' :
                                        kpi.colorClass === 'gold' ? 'bg-[#FEF6E8] text-[#9B6000]' :
                                        kpi.colorClass === 'red' ? 'bg-[#FDEDEC] text-[#E74C3C]' : 'bg-[#FEF0E7] text-[#E67E22]'}
                                    `}>{kpi.trend}</span>
                                </div>
                                <div>
                                    <div className="text-[28px] font-[900] tracking-[-1px] leading-none mb-1">{kpi.value}</div>
                                    <div className="text-[11px] text-[#5A7266] font-[500]">{kpi.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* BOTTOM SECTION */}
                    <div className="space-y-[24px] mb-[24px]">
                        {/* Order Status Breakdown - FULL WIDTH */}
                        <div className="bg-white rounded-[16px] border-[1.5px] border-[#E4EDE8] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8">
                            <div className="flex items-center gap-3 text-[18px] font-[900] text-[#0F1A14] mb-8">
                                <div className="w-[44px] h-[44px] bg-[#E8F7EF] rounded-[12px] flex items-center justify-center text-[22px] text-[#1A8A47] shadow-sm">📊</div>
                                Order Status Breakdown
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { label: 'Delivered', count: stats.delivered, lpo: stats.deliveredLPO, invoice: stats.deliveredInvoice, color: '#2DBE6C', icon: '✅' },
                                    { label: 'Partial', count: stats.partial, lpo: stats.partialLPO, invoice: stats.partialInvoice, color: '#E67E22', icon: '⚠️' },
                                    { label: 'Pending', count: stats.pending, lpo: stats.pendingLPO, invoice: stats.pendingInvoice, color: '#F5A623', icon: '⏳' },
                                    { label: 'Canceled', count: stats.canceledOrders, lpo: stats.canceledLPO, invoice: stats.canceledInvoice, color: '#E74C3C', icon: '❌' },
                                ].map((s, i) => {
                                    const pct = stats.total > 0 ? Math.round(s.count / stats.total * 100) : 0;
                                    return (
                                        <div key={i} className="bg-[#F8FAFC] rounded-[22px] p-6 border border-slate-100 flex flex-col gap-6 hover:shadow-md transition-all group hover:-translate-y-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[20px] shadow-sm">{s.icon}</div>
                                                    <div className="text-[13px] font-[900] text-[#5A7266] uppercase tracking-wider">{s.label}</div>
                                                </div>
                                                <div className="text-[17px] font-[950] font-mono-dm text-[#0F1A14] bg-white px-3 py-1 rounded-xl shadow-sm border border-slate-100">
                                                    {pct}%
                                                </div>
                                            </div>

                                            <div className="flex items-baseline gap-2">
                                                <div className="text-[42px] font-[950] tracking-tighter leading-none" style={{ color: s.color }}>
                                                    {s.count}
                                                </div>
                                                <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Orders</div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="w-full h-[10px] bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 pt-2">
                                                    <div className="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">LPO Value</span>
                                                        </div>
                                                        <span className="text-[13px] font-[900] text-slate-700">AED {s.lpo.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/50">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Invoice Value</span>
                                                        </div>
                                                        <span className="text-[13px] font-[900] text-indigo-600">AED {s.invoice.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Financial Summary - FULL WIDTH */}
                        <div className="bg-white rounded-[16px] border-[1.5px] border-[#E4EDE8] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8">
                            <div className="flex items-center gap-3 text-[18px] font-[800] text-[#0F1A14] mb-[24px]">
                                <div className="w-[40px] h-[40px] bg-[#EBF5FB] rounded-[10px] flex items-center justify-center text-[20px] text-[#2980B9] shadow-sm">💰</div>
                                Financial Summary
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-[24px]">
                                <div className="bg-[#F8FAFC] rounded-[18px] p-[24px_20px] text-center border border-slate-200 shadow-[0_8px_20px_rgba(0,0,0,0.02)] transition-transform hover:scale-[1.02]">
                                    <div className="text-[11px] text-[#64748B] font-black uppercase mb-[10px] tracking-[0.1em]">Total LPO Value</div>
                                    <div className="text-[12px] text-[#475569] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">All selected orders</div>
                                    <div className="text-[32px] font-[950] font-mono-dm text-[#0F172A] tracking-tighter leading-none mb-2">{stats.totalLPO.toLocaleString()}</div>
                                    <div className="text-[14px] font-[800] text-[#64748B] bg-white/80 border border-slate-100 rounded-lg py-1 px-3 inline-block">AED</div>
                                </div>
                                <div className="bg-[#F5F3FF] rounded-[18px] p-[24px_20px] text-center border border-[#DDD6FE] shadow-[0_8px_20px_rgba(139,92,246,0.04)] transition-transform hover:scale-[1.02]">
                                    <div className="text-[11px] text-[#7C3AED] font-black uppercase mb-[10px] tracking-[0.1em]">Total Invoice Value</div>
                                    <div className="text-[12px] text-[#7C3AED] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">Realized Revenue</div>
                                    <div className="text-[32px] font-[950] font-mono-dm text-[#4C1D95] tracking-tighter leading-none mb-2">{stats.totalInvoice.toLocaleString()}</div>
                                    <div className="text-[14px] font-[800] text-[#7C3AED] bg-white/80 border border-[#DDD6FE] rounded-lg py-1 px-3 inline-block">AED</div>
                                </div>
                                <div className="bg-[#FDEDEC] rounded-[18px] p-[24px_20px] text-center border border-[#E74C3C]/20 shadow-[0_8px_20px_rgba(231,76,60,0.06)] transition-transform hover:scale-[1.02]">
                                    <div className="text-[11px] text-[#5A7266] font-black uppercase mb-[10px] tracking-[0.1em]">Invoice Under LPO</div>
                                    <div className="text-[12px] text-[#A93226] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">We take less 📉</div>
                                    <div className="text-[32px] font-[950] font-mono-dm text-[#E74C3C] tracking-tighter leading-none mb-2">{stats.favor.toLocaleString()}</div>
                                    <div className="text-[14px] font-[800] text-[#A93226] bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-lg py-1 px-3 inline-block">{stats.favorCount} <span className="text-[11px] opacity-70">Orders</span></div>
                                </div>
                                <div className="bg-[#EEF2FF] rounded-[18px] p-[24px_20px] text-center border border-[#4F46E5]/20 shadow-[0_8px_20px_rgba(79,70,229,0.06)] transition-transform hover:scale-[1.02]">
                                    <div className="text-[11px] text-[#64748B] font-black uppercase mb-[10px] tracking-[0.1em]">Invoice Over LPO</div>
                                    <div className="text-[12px] text-[#4F46E5] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">We take more 📈</div>
                                    <div className="text-[32px] font-[950] font-mono-dm text-[#312E81] tracking-tighter leading-none mb-2">{stats.against.toLocaleString()}</div>
                                    <div className="text-[14px] font-[800] text-[#4F46E5] bg-[#EEF2FF] border border-[#4F46E5]/20 rounded-lg py-1 px-3 inline-block">{stats.againstCount} <span className="text-[11px] opacity-70">Orders</span></div>
                                </div>
                                <div className="bg-[#F6F9F7] rounded-[18px] p-[24px_20px] text-center border border-[#B2C4BB]/40 shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-transform hover:scale-[1.02]">
                                    <div className="text-[11px] text-[#5A7266] font-black uppercase mb-[10px] tracking-[0.1em]">Net Difference</div>
                                    <div className="text-[12px] text-[#5A7266] font-bold mb-[12px] bg-white/60 rounded-full py-1 px-3 inline-block shadow-sm">Overall balance</div>
                                    <div className={`text-[32px] font-[950] font-mono-dm tracking-tighter leading-none mb-2 ${stats.net >= 0 ? 'text-[#4F46E5]' : 'text-[#E74C3C]'}`}>
                                        {stats.net >= 0 ? '+' : '-'}{Math.abs(stats.net).toLocaleString()}
                                    </div>
                                    <div className="text-[14px] font-[800] text-[#5A7266] bg-white/80 border border-[#B2C4BB]/30 rounded-lg py-1 px-3 inline-block">{stats.favorCount + stats.againstCount} <span className="text-[11px] opacity-70">Issues</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {statsSubTab === 'daily' && (
                <div className="bg-white rounded-[16px] border-[1.5px] border-[#E4EDE8] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8 mb-[24px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Date</th>
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Day</th>
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">LPO Value</th>
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Invoice Value</th>
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Orders</th>
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Delivered</th>
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Partial</th>
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Canceled</th>
                                    <th className="px-6 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center">Pending</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-20">
                                            <NoData
                                                title="No Daily Stats"
                                                message="No daily sales or distribution activity found for the selected period."
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {dailyStats.map((d: any, idx) => {
                                            const dayName = d.date && d.date !== 'No Date'
                                                ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(d.date))
                                                : '-';
                                            return (
                                                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-4 font-bold text-[#0F1A14] text-center font-mono-dm">{d.date}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-[900] uppercase tracking-wider">
                                                            {dayName}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-slate-700 text-center">{formatStat(d.lpoValue)}</td>
                                                    <td className="px-6 py-4 font-black text-indigo-600 text-center">{formatStat(d.invoiceValue)}</td>
                                                    <td className="px-6 py-4 font-black text-slate-600 text-center">{formatStat(d.orders)}</td>
                                                    <td className="px-6 py-4 font-black text-[#2DBE6C] text-center">{formatStat(d.delivered)}</td>
                                                    <td className="px-6 py-4 font-black text-orange-500 text-center">{formatStat(d.partial)}</td>
                                                    <td className="px-6 py-4 font-black text-red-500 text-center">{formatStat(d.canceled)}</td>
                                                    <td className="px-6 py-4 font-black text-amber-500 text-center">{formatStat(d.pending)}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* TOTAL ROW */}
                                        <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-[#1E293B] uppercase tracking-wider" colSpan={2}>TOTAL</td>
                                            <td className="px-6 py-4 font-[950] text-slate-900 text-center bg-slate-100/50">{formatStat(dailyTotals.lpoValue)}</td>
                                            <td className="px-6 py-4 font-[950] text-indigo-700 text-center bg-indigo-50/50">{formatStat(dailyTotals.invoiceValue)}</td>
                                            <td className="px-6 py-4 font-[950] text-slate-900 text-center">{formatStat(dailyTotals.orders)}</td>
                                            <td className="px-6 py-4 font-[950] text-[#2DBE6C] text-center bg-green-50/30">{formatStat(dailyTotals.delivered)}</td>
                                            <td className="px-6 py-4 font-[950] text-orange-700 text-center bg-orange-50/30">{formatStat(dailyTotals.partial)}</td>
                                            <td className="px-6 py-4 font-[950] text-red-700 text-center bg-red-50/30">{formatStat(dailyTotals.canceled)}</td>
                                            <td className="px-6 py-4 font-[950] text-amber-700 text-center bg-amber-50/30">{formatStat(dailyTotals.pending)}</td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {statsSubTab === 'cities' && (
                <div className="bg-white rounded-[24px] border-[1.5px] border-[#E4EDE8] shadow-sm overflow-hidden animate-in fade-in duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#F1F5F9]">
                                    <th className="px-4 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider w-[50px]">#</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">City Name</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">LPO Value</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Invoice Value</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Difference</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Orders</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-[#059669]">Delivered</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-[#D97706]">Partial</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-amber-500">Pending</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-red-500">Canceled</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {cityStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-20">
                                            <NoData
                                                title="No City Data"
                                                message="No distribution data found for cities under current filters."
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {cityStats.map((c: any, i) => {
                                            const diff = c.invoiceValue - c.lpoValue;
                                            return (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-4 text-center text-[13px] font-[800] text-slate-400 bg-slate-50/50">{i + 1}</td>
                                                    <td className="px-6 py-4 text-center text-[14px] font-[800] text-[#1E293B]">{c.name}</td>
                                                    <td className="px-6 py-4 text-center text-[14px] font-[900] text-slate-800">{formatStat(c.lpoValue, 'AED ')}</td>
                                                    <td className="px-6 py-4 text-center text-[14px] font-[900] text-indigo-600">{formatStat(c.invoiceValue, 'AED ')}</td>
                                                    <td className={`px-6 py-4 text-center text-[14px] font-[900] ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {diff === 0 ? '-' : (diff > 0 ? '+' : '') + diff.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-[14px] font-[800] text-slate-600">{formatStat(c.orders)}</td>
                                                    <td className="px-6 py-4 text-center text-[14px] font-[800] text-green-600 bg-green-50/30">{formatStat(c.delivered)}</td>
                                                    <td className="px-6 py-4 text-center text-[14px] font-[800] text-orange-600 bg-orange-50/30">{formatStat(c.partial)}</td>
                                                    <td className="px-6 py-4 text-center text-[14px] font-[800] text-amber-600 bg-amber-50/30">{formatStat(c.pending)}</td>
                                                    <td className="px-6 py-4 text-center text-[14px] font-[800] text-red-600 bg-red-50/30">{formatStat(c.canceled)}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* TOTAL ROW */}
                                        <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                            <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider"></td>
                                            <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider">TOTAL</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-slate-900 bg-slate-100/50">{formatStat(cityTotals.lpoValue, 'AED ')}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-[#312E81] bg-slate-100/50">{formatStat(cityTotals.invoiceValue, 'AED ')}</td>
                                            <td className={`px-6 py-4 text-center text-[14px] font-[950] bg-slate-100/50 ${(cityTotals.invoiceValue - cityTotals.lpoValue) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                {(cityTotals.invoiceValue - cityTotals.lpoValue) === 0 ? '-' : ((cityTotals.invoiceValue - cityTotals.lpoValue) > 0 ? '+' : '') + (cityTotals.invoiceValue - cityTotals.lpoValue).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-slate-900">{formatStat(cityTotals.orders)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-green-700 bg-green-100/30">{formatStat(cityTotals.delivered)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-orange-700 bg-orange-100/30">{formatStat(cityTotals.partial)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-amber-700 bg-amber-100/30">{formatStat(cityTotals.pending)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-red-700 bg-red-100/30">{formatStat(cityTotals.canceled)}</td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {statsSubTab === 'customers' && (
                <div className="bg-white rounded-[24px] border-[1.5px] border-[#E4EDE8] shadow-sm overflow-hidden animate-in fade-in duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#F1F5F9]">
                                    <th className="px-4 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider w-[50px]">#</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Customer Name</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Total Orders</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-[#059669]">Delivered</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-[#D97706]">Partial</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-amber-500">Pending</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-red-500">Canceled</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-orange-600">Pending Items</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-green-600">Reshipped Items</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-red-600">Canceled Items</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {customerStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-20">
                                            <NoData
                                                title="No Customer Data"
                                                message="No customer-specific tracking statistics available for these filters."
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {customerStats.map((c: any, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-4 text-center text-[13px] font-[800] text-slate-400 bg-slate-50/50">{i + 1}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-[#1E293B]">{c.name}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-slate-600">{formatStat(c.total)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-green-600 bg-green-50/30">{formatStat(c.delivered)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-orange-600 bg-orange-50/30">{formatStat(c.partial)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-amber-600 bg-amber-50/30">{formatStat(c.pending)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-red-600 bg-red-50/30">{formatStat(c.canceledOrders)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-orange-500">{formatStat(c.missingCount)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-green-500">{formatStat(c.reshippedCount)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-red-500">{formatStat(c.canceledCount)}</td>
                                            </tr>
                                        ))}
                                        {/* TOTAL ROW */}
                                        <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                            <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider"></td>
                                            <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider">TOTAL</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-slate-900 bg-slate-100/50">{formatStat(customerTotals.total)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-green-700 bg-green-100/30">{formatStat(customerTotals.delivered)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-orange-700 bg-orange-100/30">{formatStat(customerTotals.partial)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-amber-700 bg-amber-100/30">{formatStat(customerTotals.pending)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-red-700 bg-red-100/30">{formatStat(customerTotals.canceledOrders)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-orange-800">{formatStat(customerTotals.missingCount)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-green-800">{formatStat(customerTotals.reshippedCount)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-red-800">{formatStat(customerTotals.canceledCount)}</td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {statsSubTab === 'products' && (
                <div className="bg-white rounded-[24px] border-[1.5px] border-[#E4EDE8] shadow-sm overflow-hidden animate-in fade-in duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#F1F5F9]">
                                    <th className="px-4 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider w-[50px]">#</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider">Product Name</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-red-600">Total Canceled</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-orange-600">Pending Re-ship</th>
                                    <th className="px-6 py-4 text-center text-[12px] font-[800] text-[#475569] uppercase tracking-wider text-green-600">Total Shipped</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {productStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20">
                                            <NoData
                                                title="No Product Data"
                                                message="No product-level status logs found for the selected orders."
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {productStats.map((p: any, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-4 text-center text-[13px] font-[800] text-slate-400 bg-slate-50/50">{i + 1}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-[#1E293B]">{p.name}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-red-600 bg-red-50/30">{formatStat(p.canceled)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-orange-600 bg-orange-50/30">{formatStat(p.pending)}</td>
                                                <td className="px-6 py-4 text-center text-[14px] font-[800] text-green-600 bg-green-50/30">{formatStat(p.shipped)}</td>
                                            </tr>
                                        ))}
                                        {/* TOTAL ROW */}
                                        <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                            <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider"></td>
                                            <td className="px-6 py-4 text-center text-[15px] font-[950] text-[#1E293B] uppercase tracking-wider">TOTAL</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-red-700 bg-red-100/30">{formatStat(productTotals.canceled)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-orange-700 bg-orange-100/30">{formatStat(productTotals.pending)}</td>
                                            <td className="px-6 py-4 text-center text-[14px] font-[950] text-green-700 bg-green-100/30">{formatStat(productTotals.shipped)}</td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
