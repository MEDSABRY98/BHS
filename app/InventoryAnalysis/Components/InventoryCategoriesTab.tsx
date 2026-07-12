'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, ShoppingCart,
    ArrowUpDown, RotateCw, RefreshCw, AlertCircle, FileDown,
    ChevronLeft, ChevronRight, FileSpreadsheet, Box
} from 'lucide-react';
import Loading from '@/app/Components/Loading';
import InventoryProductOrdersDetailsTab from './InventoryCategoriesDetailsTab';
import NoData from '@/app/Components/NoDataTab';
import { getProductOrdersData, getProductMovementsData } from '../Service/inventory_service';
import { exportAllCategoriesZip } from './ExcelExport';

const formatCategory = (tag: string) => {
    if (!tag || tag === 'All' || tag === 'Uncategorized') return tag;
    const parts = tag.split('/');
    return parts[parts.length - 1].trim();
};

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
                formattedTag: formatCategory(p.tags),
                // Map the new fields from the sheet
                onHand: p.qty || 0
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
            const tag = p.formattedTag;
            if (tag) uniqueTags.add(tag);
            else uniqueTags.add('Uncategorized');
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
            <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-3xl border border-red-100 mt-4">
                <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
                <h3 className="text-2xl font-black text-red-800 mb-2">Error Connection</h3>
                <p className="text-red-600 mb-8 max-w-md text-center font-medium">{error}</p>
                <button
                    onClick={fetchOrders}
                    className="px-8 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-lg hover:shadow-red-200 flex items-center gap-2 font-bold"
                >
                    <RefreshCw className="w-5 h-5" /> Retry Sync
                </button>
            </div>
        );
    }

    if (loading && products.length === 0) return <Loading message="Fetching Inventory Summary..." />;

    // If a category is selected, show the details view
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

    // Otherwise, show the Category Summary View
    const categoryStats = tags.map(tag => {
        const catProducts = products.filter(p => p.formattedTag === tag);
        const count = catProducts.length;
        const outOfStockCount = catProducts.filter(p => p.onHand <= 0).length;
        return { tag, count, outOfStockCount };
    }).filter(c => c.tag.toLowerCase().includes(categorySearch.toLowerCase()));

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Summary Dashboard Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Categories', value: tags.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Total Products', value: products.length, icon: Box, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Out of Stock', value: products.filter(p => p.onHand <= 0).length, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-shadow hover:shadow-md">
                        <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{stat.label}</p>
                            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Category Search & Refresh */}
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                        placeholder="Search categories..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                    />
                </div>
                <button
                    onClick={fetchOrders}
                    disabled={loading}
                    className="flex items-center justify-center p-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 active:scale-95 transition-all shadow-sm min-w-[48px]"
                    title="Refresh Data"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                    onClick={handleExportAll}
                    disabled={loading || exportingAll}
                    className="flex items-center justify-center p-3 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm min-w-[48px]"
                    title="Export All to ZIP"
                >
                    <FileSpreadsheet className={`w-5 h-5 ${exportingAll ? 'animate-pulse' : ''}`} />
                </button>
            </div>

            {/* Category Cards Grid */}
            {categoryStats.length === 0 ? (
                <NoData title="No Categories" />
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {categoryStats.map((cat) => (
                    <button
                        key={cat.tag}
                        onClick={() => setSelectedCategory(cat.tag)}
                        className="group bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left flex flex-col h-full"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                                <Package className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-snug line-clamp-2">
                                {cat.tag}
                            </h3>
                        </div>

                        <div className="flex items-center gap-2 mt-auto">
                            <div className="flex-1 py-1.5 bg-slate-50 text-slate-600 text-[11px] font-semibold rounded border border-slate-200 uppercase tracking-wider text-center">
                                {cat.count} Items
                            </div>
                            {cat.outOfStockCount > 0 ? (
                                <div className="flex-1 py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded border border-red-200 uppercase tracking-wider flex items-center justify-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    {cat.outOfStockCount} OUT
                                </div>
                            ) : (
                                <div className="flex-1 py-1.5 bg-emerald-50 text-emerald-600 text-[11px] font-semibold rounded border border-emerald-200 uppercase tracking-wider text-center">
                                    ALL STOCKED
                                </div>
                            )}
                        </div>
                    </button>
                ))}
            </div>
            )}
        </div>
    );
}
