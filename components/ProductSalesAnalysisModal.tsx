'use client';

import React, { useMemo } from 'react';
import {
    X, TrendingUp, TrendingDown, Box,
    BarChart3, Activity, ArrowRight
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { ProductOrder } from './InventoryProductOrdersMakeTab';

// Extended interface locally if needed, though we expect the one passed from parent to have salesBreakdown
interface ExtendedProductOrder extends ProductOrder {
    salesBreakdown?: { label: string; qty: number }[];
}

interface Props {
    product: ExtendedProductOrder;
    isOpen: boolean;
    onClose: () => void;
    packSize: number; // For carton conversion
}

export default function ProductSalesAnalysisModal({ product, isOpen, onClose, packSize }: Props) {
    if (!product || !isOpen) return null;

    const data = useMemo(() => {
        if (!product.salesBreakdown) return [];
        // Ensure chronological order for chart (Oldest -> Newest)
        // Our breakdown is already [M4(3ago), M3(2ago), M2(Last), M1(Current)] which is Oldest->Newest as requested previously.
        // Let's verify labels/data match that expectation.

        return product.salesBreakdown.map(item => ({
            name: item.label,
            sales: item.qty,
            cartons: packSize > 0 ? Number((item.qty / packSize).toFixed(1)) : item.qty
        }));
    }, [product, packSize]);

    const metrics = useMemo(() => {
        const totalSalesPcs = data.reduce((sum, item) => sum + item.sales, 0); // In Pieces
        const totalSalesCartons = packSize > 0 ? totalSalesPcs / packSize : totalSalesPcs;

        // Growth Calculation
        let growthPercent = 0;
        let growthTrend: 'up' | 'down' | 'flat' = 'flat';

        if (data.length >= 3) {
            const lastMonth = data[data.length - 2].sales; // Last Full
            const prevMonth = data[data.length - 3].sales; // 2 Ago

            if (prevMonth > 0) {
                growthPercent = ((lastMonth - prevMonth) / prevMonth) * 100;
            } else if (lastMonth > 0) {
                growthPercent = 100;
            }
        }

        if (growthPercent > 0.5) growthTrend = 'up';
        else if (growthPercent < -0.5) growthTrend = 'down';

        // Stock to Sales Ratio (Coverage)
        // Stock is in Pieces, so we must use Sales in Pieces for the denominator
        const avgMonthlySalesPcs = totalSalesPcs / Math.max(1, data.length);
        const weeksOfStock = avgMonthlySalesPcs > 0
            ? (product.qtyFreeToUse / (avgMonthlySalesPcs / 4))
            : 0;

        return {
            totalSalesCartons: Number(totalSalesCartons.toFixed(1)),
            avgMonthlySales: Number(avgMonthlySalesPcs.toFixed(0)), // Keep raw Pcs for internal use if needed, but display usually converts
            growthPercent: Number(growthPercent.toFixed(1)),

            growthTrend,
            weeksOfStock: Number(weeksOfStock.toFixed(1)),
            stockStatus: weeksOfStock < 1 ? 'Critical' : weeksOfStock < 4 ? 'Low' : weeksOfStock > 12 ? 'Overstock' : 'Healthy'
        };
    }, [data, product.qtyFreeToUse, packSize]);

    // Colors
    const chartColor = metrics.growthTrend === 'down' ? '#ef4444' : '#3b82f6';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gray-50/50 border-b border-gray-100 p-6 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-md font-mono">
                                {product.barcode || 'No Barcode'}
                            </span>
                            {product.qtyFreeToUse <= 0 && (
                                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> OUT OF STOCK
                                </span>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{product.productName}</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <Box className="w-4 h-4" />
                                Units/Carton:
                                <span className="font-semibold text-gray-900 ml-1">
                                    {packSize > 1 ? packSize : 'N/A'}
                                </span>
                            </span>
                            <span className="flex items-center gap-1">
                                <Activity className="w-4 h-4" />
                                Stock:
                                <span className="font-semibold text-gray-900 ml-1">
                                    {product.qtyFreeToUse}
                                </span>
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {/* Total Sales */}
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <p className="text-sm font-medium text-blue-600 mb-1">Total Sales (4 Mo)</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-blue-900">{metrics.totalSalesCartons}</span>
                                <span className="text-sm font-semibold text-blue-400">Ctns</span>
                            </div>
                        </div>

                        {/* Monthly Avg */}
                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                            <p className="text-sm font-medium text-indigo-600 mb-1">Avg. Monthly</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-indigo-900">
                                    {packSize > 1 ? (metrics.avgMonthlySales / packSize).toFixed(1) : metrics.avgMonthlySales}
                                </span>
                                <span className="text-sm font-semibold text-indigo-400">Ctns</span>
                            </div>
                        </div>

                        {/* Recent Growth */}
                        <div className={`p-4 rounded-2xl border ${metrics.growthTrend === 'up' ? 'bg-emerald-50/50 border-emerald-100' : metrics.growthTrend === 'down' ? 'bg-red-50/50 border-red-100' : 'bg-gray-50/50 border-gray-100'}`}>
                            <p className={`text-sm font-medium mb-1 ${metrics.growthTrend === 'up' ? 'text-emerald-600' : metrics.growthTrend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                                Growth (Last Mo)
                            </p>
                            <div className="flex items-center gap-2">
                                <span className={`text-3xl font-bold ${metrics.growthTrend === 'up' ? 'text-emerald-900' : metrics.growthTrend === 'down' ? 'text-red-900' : 'text-gray-900'}`}>
                                    {Math.abs(metrics.growthPercent)}%
                                </span>
                                {metrics.growthTrend === 'up' ? (
                                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                                ) : metrics.growthTrend === 'down' ? (
                                    <TrendingDown className="w-6 h-6 text-red-500" />
                                ) : (
                                    <Activity className="w-6 h-6 text-gray-400" />
                                )}
                            </div>
                        </div>

                        {/* Inventory Health */}
                        <div className={`p-4 rounded-2xl border ${metrics.stockStatus === 'Critical' ? 'bg-red-50/50 border-red-100' :
                            metrics.stockStatus === 'Overstock' ? 'bg-amber-50/50 border-amber-100' :
                                'bg-green-50/50 border-green-100'
                            }`}>
                            <p className="text-sm font-medium mb-1 text-gray-600">Stock Coverage</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-3xl font-bold ${metrics.stockStatus === 'Critical' ? 'text-red-900' :
                                    metrics.stockStatus === 'Overstock' ? 'text-amber-900' :
                                        'text-green-900'
                                    }`}>
                                    {metrics.weeksOfStock}
                                </span>
                                <span className="text-sm font-medium text-gray-500">Weeks</span>
                            </div>
                            <p className="text-xs font-medium opacity-70 mt-1">{metrics.stockStatus}</p>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-gray-400" />
                                Sales Trend
                            </h3>
                            <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span className="text-gray-600">Actual Sales (Ctns)</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                                        }}
                                        itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                                        labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                                        formatter={(value: number) => [
                                            `${value} ${packSize > 1 ? 'Ctns' : 'Pcs'}`,
                                            'Sales'
                                        ]}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey={packSize > 1 ? "cartons" : "sales"}
                                        stroke={chartColor}
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorSales)"
                                        activeDot={{ r: 6, strokeWidth: 0, fill: chartColor }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
