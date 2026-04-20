'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, ShoppingCart,
    ArrowUpDown, RotateCw, RefreshCw, AlertCircle, FileDown,
    ChevronLeft, ChevronRight, FileSpreadsheet, Box
} from 'lucide-react';
import Loading from './Loading';
import InventoryProductOrdersDetailsTab from './InventoryCategoriesDetailsTab';
import NoData from './Unified/NoDataTab';

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
    qinc: number;
    rowIndex: number;
    minQ?: number;
    maxQ?: number;
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

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/inventory');
            const json = await res.json();

            if (!res.ok) throw new Error(json.details || json.error || 'Failed to fetch orders data');

            const data = (json.data || []).map((p: any) => ({
                ...p,
                formattedTag: formatCategory(p.tags),
                // Map the new fields from the sheet
                onHand: p.qtyFreeToUse || 0,
                qinc: p.qinc || 1,
                minQ: p.minQ,
                maxQ: p.maxQ
            }));
            setProducts(data);
            setError(null);
        } catch (err) {
            console.error('Error loading orders:', err);
            setError('Failed to load orders data from Google Sheets');
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
        const lowStockCount = catProducts.filter(p => p.onHand <= (p.minQ || 0) * (p.qinc || 1)).length;
        const outOfStockCount = catProducts.filter(p => p.onHand === 0).length;
        return { tag, count, lowStockCount, outOfStockCount };
    }).filter(c => c.tag.toLowerCase().includes(categorySearch.toLowerCase()));

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Summary Dashboard Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Categories', value: tags.length, icon: Package, color: 'blue' },
                    { label: 'Total Products', value: products.length, icon: Box, color: 'emerald' },
                    { label: 'Zero Stock', value: products.filter(p => p.onHand === 0).length, icon: AlertCircle, color: 'red' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-xl shadow-slate-200/50 flex items-center gap-6 group hover:shadow-2xl transition-all duration-500">
                        <div className={`p-5 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                            <stat.icon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-800">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Category Search & Refresh */}
            <div className="flex items-center gap-4 bg-white p-5 rounded-[2rem] border border-gray-100 shadow-lg">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search className="h-6 w-6 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-transparent rounded-2xl text-base font-bold text-slate-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        placeholder="Search product categories..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                    />
                </div>
                <button
                    onClick={fetchOrders}
                    disabled={loading}
                    className="flex items-center justify-center p-4 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 active:scale-95 transition-all shadow-lg min-w-[56px]"
                    title="Refresh Data"
                >
                    <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Category Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categoryStats.map((cat) => (
                    <button
                        key={cat.tag}
                        onClick={() => setSelectedCategory(cat.tag)}
                        className="group bg-white p-5 rounded-[2rem] border border-gray-100 shadow-md hover:shadow-xl hover:border-blue-100/50 hover:-translate-y-1 transition-all duration-300 text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                    <Package className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 group-hover:text-blue-700 transition-colors leading-tight line-clamp-2 pr-4">
                                    {cat.tag}
                                </h3>
                            </div>

                            <div className="flex items-center gap-3 mt-auto">
                                <div className="w-[115px] px-3 py-2 bg-slate-100 text-slate-500 text-[12px] font-bold rounded-lg uppercase tracking-tighter text-center">
                                    {cat.count} Items
                                </div>
                                {cat.outOfStockCount > 0 ? (
                                    <div className="w-[115px] px-3 py-2 bg-red-50 text-red-600 text-[12px] font-bold rounded-lg border border-red-100 uppercase tracking-tighter flex items-center justify-center gap-1.5 shadow-sm">
                                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                        {cat.outOfStockCount} OUT
                                    </div>
                                ) : (
                                    <div className="w-[115px] px-3 py-2 bg-blue-50/50 text-blue-400 text-[12px] font-bold rounded-lg border border-blue-50 border-dashed uppercase tracking-tighter text-center">
                                        ALL IN STOCK
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {categoryStats.length === 0 && (
                <NoData title="No Categories" />
            )}
        </div>
    );
}
