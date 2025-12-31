'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Package, ShoppingCart,
    ArrowUpDown, RotateCw, RefreshCw, AlertCircle
} from 'lucide-react';
import Loading from './Loading';
import { OrderItem, ProductOrder as BaseProductOrder } from './ProductOrdersMakeTab';

// Ensure local interface matches BaseProductOrder so we can cast it.
interface ProductOrder extends BaseProductOrder { }

interface Props {
    orderItems: OrderItem[];
    setOrderItems: (items: OrderItem[]) => void;
}

// --- Components ---
const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: number | string, icon: any, color: 'blue' | 'green' | 'red' | 'amber' }) => {
    const styles = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', icon: 'text-blue-600' },
        green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', icon: 'text-green-600' },
        red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', icon: 'text-red-600' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: 'text-amber-600' },
    };

    const s = styles[color];

    return (
        <div className={`rounded-xl border ${s.border} bg-white p-5 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <div className={`text-2xl font-bold ${s.text}`}>{value}</div>
                </div>
                <div className={`p-3 rounded-lg ${s.bg}`}>
                    <Icon className={`w-6 h-6 ${s.icon}`} />
                </div>
            </div>
        </div>
    );
};

export default function ProductOrdersTab({ orderItems, setOrderItems }: Props) {
    const [products, setProducts] = useState<ProductOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<keyof ProductOrder>('qtyFreeToUse');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>('all');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/inventory/orders');
            const json = await res.json();

            if (!res.ok) throw new Error(json.details || json.error || 'Failed to fetch orders data');

            setProducts(json.data || []);
            setError(null);
        } catch (err) {
            console.error('Error loading orders:', err);
            setError('Failed to load orders data');
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const totalProducts = products.length;
        const lowStock = products.filter(p => p.qtyFreeToUse <= 10).length;
        const outOfStock = products.filter(p => p.qtyFreeToUse <= 0).length;

        return { totalProducts, lowStock, outOfStock };
    }, [products]);

    const filteredAndSortedProducts = useMemo(() => {
        let result = [...products];

        // Filter by Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.productName.toLowerCase().includes(query) ||
                p.barcode.toLowerCase().includes(query) ||
                p.productId.toLowerCase().includes(query) ||
                p.tags.toLowerCase().includes(query)
            );
        }

        // Filter by Status
        if (statusFilter !== 'all') {
            result = result.filter(p => {
                if (statusFilter === 'out_of_stock') return p.qtyFreeToUse <= 0;
                if (statusFilter === 'low_stock') return p.qtyFreeToUse > 0 && p.qtyFreeToUse <= 10;
                if (statusFilter === 'in_stock') return p.qtyFreeToUse > 0;
                return true;
            });
        }

        // Sort
        result.sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            return 0;
        });

        return result;
    }, [products, searchQuery, statusFilter, sortField, sortDirection]);

    const handleSort = (field: keyof ProductOrder) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field: keyof ProductOrder) => {
        if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return <ArrowUpDown className={`w-4 h-4 text-blue-600 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />;
    };

    // Helper to handle order qty change
    const handleOrderQtyChange = (product: ProductOrder, qtyStr: string) => {
        const qty = parseInt(qtyStr);

        if (isNaN(qty) || qty <= 0) {
            // If empty string or invalid, remove from order logic could be debated.
            // User: "don't delete the number visual input"
            // But we display `orderItem.orderQty`. So if I type 0, it removes from list, and visual becomes empty or 0.
            // Let's stick to standard behavior: if invalid/0, remove from list.
            if (qtyStr === '' || qty === 0) {
                setOrderItems(orderItems.filter(item => item.productId !== product.productId));
            }
            return;
        }

        const existingItemIndex = orderItems.findIndex(item => item.productId === product.productId);

        if (existingItemIndex >= 0) {
            // Update
            const newItems = [...orderItems];
            newItems[existingItemIndex] = { ...newItems[existingItemIndex], orderQty: qty };
            setOrderItems(newItems);
        } else {
            // Add
            setOrderItems([...orderItems, { ...product, orderQty: qty }]);
        }
    };

    if (loading && products.length === 0) return <Loading message="Loading Product Orders..." />;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-2xl border border-red-100 mt-4">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-red-700 mb-2">Error Loading Data</h3>
                <p className="text-red-500 mb-6">{error}</p>
                <button
                    onClick={fetchOrders}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                    <RotateCw className="w-4 h-4" /> Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Search & Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Total Products"
                    value={stats.totalProducts}
                    icon={Package}
                    color="blue"
                />
                <StatCard
                    title="Low Stock Warning"
                    value={stats.lowStock}
                    icon={AlertCircle}
                    color="amber"
                />
                <StatCard
                    title="Out of Stock"
                    value={stats.outOfStock}
                    icon={ShoppingCart}
                    color="red"
                />
            </div>

            <div className="relative flex flex-col md:flex-row justify-center items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative w-full max-w-xl group flex gap-2">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center placeholder:text-center"
                            placeholder="Search by name, barcode, ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                        <option value="all">All Status</option>
                        <option value="in_stock">In Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                        <option value="low_stock">Low Stock</option>
                    </select>
                </div>

                <div className="flex items-center gap-3 md:absolute md:right-4">
                    <button
                        onClick={fetchOrders}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th
                                    className="w-[25%] pl-8 pr-2 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer group hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('productName')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Product Name
                                        {getSortIcon('productName')}
                                    </div>
                                </th>
                                <th
                                    className="w-[15%] px-2 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer group hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('barcode')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Barcode
                                        {getSortIcon('barcode')}
                                    </div>
                                </th>
                                <th
                                    className="w-[15%] px-2 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer group hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('qtyOnHand')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Qty On Hand
                                        {getSortIcon('qtyOnHand')}
                                    </div>
                                </th>
                                <th
                                    className="w-[15%] px-2 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer group hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('qtyFreeToUse')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Free To Use
                                        {getSortIcon('qtyFreeToUse')}
                                    </div>
                                </th>
                                <th
                                    className="w-[10%] px-2 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer group hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('salesQty')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Sales QTY
                                        {getSortIcon('salesQty')}
                                    </div>
                                </th>
                                <th className="w-[15%] pl-2 pr-2 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Status
                                </th>
                                <th className="w-[10%] px-2 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Make Order
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredAndSortedProducts.map((product, idx) => {
                                const isLowStock = product.qtyFreeToUse <= 10;
                                const isOutOfStock = product.qtyFreeToUse <= 0;
                                const orderItem = orderItems.find(item => item.productId === product.productId);
                                const orderQty = orderItem ? orderItem.orderQty : '';

                                return (
                                    <tr
                                        key={`${product.productId}-${idx}`}
                                        className="hover:bg-blue-50/30 transition-colors group"
                                    >
                                        <td className="pl-8 pr-2 py-4 text-center">
                                            <div className="flex flex-col items-center max-w-full">
                                                <span className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors truncate w-full" title={product.productName}>
                                                    {product.productName}
                                                </span>
                                                {product.tags && (
                                                    <span className="text-xs text-gray-500 mt-0.5 truncate w-full max-w-[200px]" title={product.tags}>
                                                        {product.tags}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap text-center">
                                            <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                {product.barcode || '---'}
                                            </span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap text-center">
                                            <span className="font-bold text-gray-700">
                                                {product.qtyOnHand}
                                            </span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap text-center">
                                            <div className="flex flex-col items-center relative">
                                                <span className={`text-lg font-black ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'
                                                    }`}>
                                                    {product.qtyFreeToUse}
                                                </span>
                                                {product.qtyFreeToUse !== product.qtyOnHand && (
                                                    <span className="text-[10px] text-gray-400 absolute -bottom-3 w-max">
                                                        (Reserved: {product.qtyOnHand - product.qtyFreeToUse})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center items-center">
                                                <span className="font-bold text-blue-600">
                                                    {product.salesQty || 0}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="pl-2 pr-2 py-4 whitespace-nowrap text-center">
                                            {isOutOfStock ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                    <AlertCircle className="w-3 h-3" /> Out of Stock
                                                </span>
                                            ) : isLowStock ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                                    <AlertCircle className="w-3 h-3" /> Low Stock
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                                    <Package className="w-3 h-3" /> In Stock
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                                value={orderQty}
                                                onChange={(e) => handleOrderQtyChange(product, e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredAndSortedProducts.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center justify-center text-gray-400">
                        <Package className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-semibold">No products found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                    </div>
                )}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500">
                    Showing {filteredAndSortedProducts.length} of {products.length} products
                </div>
            </div>
        </div>
    );
}
