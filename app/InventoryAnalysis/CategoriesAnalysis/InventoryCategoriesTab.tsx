'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, ShoppingCart,
    ArrowUpDown, RotateCw, RefreshCw, AlertCircle, FileDown,
    ChevronLeft, ChevronRight, FileSpreadsheet, Box
} from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import InventoryProductOrdersDetailsTab from './InventoryCategoriesDetailsTab';
import { getProductOrdersData, getProductMovementsData } from '../Service/inventory_service';
import { formatProductCategory } from '../Utils/locationTypes';

export interface BaseProductOrder {
    productId: string;
    productName: string;
    barcode: string;
    tags: string;
    onHand: number;
}

export interface ProductOrder extends BaseProductOrder {
    formattedTag: string;
}

export interface OrderItem extends ProductOrder {
    quantity: number;
}

interface Props {
    orderItems: OrderItem[];
    setOrderItems: (items: any) => void;
}

export default function InventoryProductOrdersTab({ orderItems, setOrderItems }: Props) {
    const [products, setProducts] = useState<ProductOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [categorySearch, setCategorySearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [exportingAll, setExportingAll] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const json = await getProductOrdersData();

            if (!json.success) throw new Error(json.details || json.error || 'Failed to fetch orders data');

            const data = (json.data || []).map((p: any) => ({
                ...p,
                formattedTag: formatProductCategory(p.tags),
                onHand: p.qty ?? 0,
            }));
            setProducts(data);
            setError(null);
        } catch (err) {
            console.error('Error loading orders:', err);
            setError('Failed to load orders data from Supabase');
        } finally {
            setLoading(false);
        }
    };

    const tags = useMemo(() => {
        const uniqueTags = new Set<string>();
        products.forEach(p => {
            const tag = p.formattedTag?.trim();
            if (tag) uniqueTags.add(tag);
        });
        return Array.from(uniqueTags).sort();
    }, [products]);

    const handleExportAll = async () => {
        try {
            setExportingAll(true);
            const movesRes = await getProductMovementsData();
            const movements = movesRes.success ? (movesRes.data || {}) : {};

            const categoriesMap: Record<string, any[]> = {};

            tags.forEach(tag => {
                const catProducts = products.filter(p => p.formattedTag === tag);
                if (catProducts.length === 0) return;

                categoriesMap[tag] = catProducts.map(p => {
                    const m = movements[p.productId] || { sales: 0, returns: 0, netPurchases: 0 };
                    return {
                        'Barcode': p.barcode,
                        'Name': p.productName,
                        'QTY (Pcs)': p.onHand,
                        'Sales': m.sales,
                        'Returns': m.returns,
                        'Purchases': m.netPurchases,
                    };
                });
            });

            const { exportAllCategoriesZip } = await import('./ExcelExport');
            await exportAllCategoriesZip(categoriesMap, 'All_Categories_Inventory.zip');
        } catch (err) {
            console.error('Export Error:', err);
            alert('Failed to export all categories');
        } finally {
            setExportingAll(false);
        }
    };

    if (error) {
        return (
            <TabFetchError
                message={error}
                onRetry={fetchOrders}
                isRetrying={loading}
                className="min-h-[360px]"
            />
        );
    }

    if (selectedCategory) {
        return (
            <InventoryProductOrdersDetailsTab
                categoryName={selectedCategory}
                products={products}
                onBack={() => setSelectedCategory(null)}
                loading={loading}
                onRefresh={fetchOrders}
                orderItems={orderItems}
                setOrderItems={setOrderItems}
            />
        );
    }

    const isInitialLoad = loading && products.length === 0;

    if (isInitialLoad) {
        return <TabLoader />;
    }

    const categoryStats = tags.map(tag => {
        const catProducts = products.filter(p => p.formattedTag === tag);
        const count = catProducts.length;
        const outOfStockCount = catProducts.filter(p => p.onHand <= 0).length;
        return { tag, count, outOfStockCount, catProducts };
    }).filter(c => {
        if (c.count === 0) return false;
        const query = categorySearch.toLowerCase();
        if (!query) return true;
        if (c.tag.toLowerCase().includes(query)) return true;
        return c.catProducts.some(p => 
            p.productName?.toLowerCase().includes(query) || 
            p.barcode?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Summary Dashboard Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Categories', value: tags.length, icon: Package },
                    { label: 'Total Products', value: products.length, icon: Box },
                    { label: 'Out of Stock', value: products.filter(p => p.onHand <= 0).length, icon: AlertCircle }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 transition-shadow hover:shadow-lg hover:border-[#D4AF37]/40">
                        <div className="bg-[#D4AF37]/10 p-3 rounded-2xl">
                            <stat.icon className="w-6 h-6 text-[#D4AF37]" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{stat.label}</p>
                            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Category Search & Refresh */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-96 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all font-medium text-gray-900 placeholder-gray-400"
                        placeholder="Search categories, products or barcodes..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={fetchOrders}
                        disabled={loading}
                        className="flex items-center justify-center p-3.5 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-2xl transition-all shadow-sm shrink-0"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleExportAll}
                        disabled={loading || exportingAll}
                        className="flex items-center justify-center p-3.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-2xl transition-all shadow-sm shrink-0"
                        title="Export All to ZIP"
                    >
                        <FileSpreadsheet className={`w-5 h-5 ${exportingAll ? 'animate-pulse' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Category Cards Grid */}
            {categoryStats.length === 0 ? (
                <NoData title="No Categories" />
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categoryStats.map((cat) => (
                    <div
                        key={cat.tag}
                        onClick={() => setSelectedCategory(cat.tag)}
                        className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:border-[#D4AF37]/40 transition-all cursor-pointer group flex flex-col h-full text-left relative overflow-hidden"
                    >
                        {/* Status Stripe */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${cat.outOfStockCount > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />

                        <div className="flex justify-between items-start mb-5 mt-1">
                            <div className="bg-[#D4AF37]/10 p-3 rounded-2xl group-hover:bg-[#D4AF37]/20 transition-colors">
                                <Package className="w-7 h-7 text-[#D4AF37]" />
                            </div>
                            <div className="flex items-center gap-2">
                                {cat.outOfStockCount > 0 && (
                                    <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-red-100">
                                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                        {cat.outOfStockCount} OUT
                                    </span>
                                )}
                                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                                    {cat.count} item(s)
                                </span>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-[#D4AF37] transition-colors leading-snug">
                            {cat.tag}
                        </h3>

                        <div className="mt-auto pt-6 flex items-center justify-between text-sm font-bold text-gray-900 group-hover:text-[#D4AF37] transition-colors">
                            View Details
                            <ChevronRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                ))}
            </div>
            )}
        </div>
    );
}
